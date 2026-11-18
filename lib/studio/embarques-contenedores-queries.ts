/**
 * SDD-0643 · Lectura de los contenedores de una lista de embarques.
 *
 * Cuatro lecturas con la sesión del usuario (la RLS por tenant de la migr
 * 0096 decide qué se ve; no se usa service_role):
 *   1. `consolidation_items` de esos embarques (la más reciente gana, igual que
 *      `getConsolidationsForShipments` del portal).
 *   2. `consolidations` vivas de esas asignaciones.
 *   3. `sailings` de esos contenedores (ETA).
 *   4. `carriers` de esos zarpes (naviera).
 *
 * SDD-0661: de la asignación vigente sale también `pieces` (las cajas que
 * escribe la carga de consolidados, SDD-0543), en `cajasPorEmbarque`.
 *
 * Devuelve `null` si alguna lectura falla: la vista lo dice y no agrupa, en vez
 * de mandar todo a «Sin contenedor» sin ser cierto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  montosPorContenedor,
  numeroDtdDeNotas,
  type ContenedorDeEmbarques,
  type ContenedoresDeEmbarques,
  type FacturaDeEmbarque,
  type MontosDeContenedores,
} from "./embarques-contenedores";

/** 100 UUID son ~3,7 KB de URL por `.in(...)`, como en adjuntos-queries. */
const TRAMO = 100;

type Fila = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function unicos(ids: readonly (string | null)[]): string[] {
  return [...new Set(ids.filter((x): x is string => !!x))];
}

async function porTramos(
  ids: readonly string[],
  leer: (tramo: string[]) => PromiseLike<{ data: Fila[] | null; error: unknown }>,
): Promise<Fila[] | null> {
  const out: Fila[] = [];
  for (let i = 0; i < ids.length; i += TRAMO) {
    const { data, error } = await leer(ids.slice(i, i + TRAMO));
    if (error) return null;
    out.push(...(data ?? []));
  }
  return out;
}

export async function leerContenedoresDeEmbarques(
  supabase: SupabaseClient,
  shipmentIds: readonly string[],
): Promise<ContenedoresDeEmbarques | null> {
  const ids = unicos(shipmentIds);
  if (ids.length === 0) return { contenedores: [], porEmbarque: {} };
  try {
    const items = await porTramos(ids, (t) =>
      supabase
        .from("consolidation_items")
        .select("shipment_id, consolidation_id, created_at, pieces")
        .in("shipment_id", t)
        .order("created_at", { ascending: false }),
    );
    if (items === null) return null;

    // Entre tramos el orden global se pierde: se elige la más reciente a mano.
    const vigente = new Map<string, { cid: string; at: string; cajas: number }>();
    for (const it of items) {
      const sid = str(it.shipment_id);
      const cid = str(it.consolidation_id);
      const at = str(it.created_at) ?? "";
      if (!sid || !cid) continue;
      const piezas = Number(it.pieces);
      const cajas = Number.isFinite(piezas) && piezas > 0 ? Math.trunc(piezas) : 0;
      const previo = vigente.get(sid);
      if (!previo || at > previo.at) vigente.set(sid, { cid, at, cajas });
    }
    const consIds = unicos([...vigente.values()].map((v) => v.cid));
    if (consIds.length === 0) return { contenedores: [], porEmbarque: {} };

    const cons = await porTramos(consIds, (t) =>
      supabase
        .from("consolidations")
        .select("id, ref, container_no, status, notes, sailing_id, created_at")
        .in("id", t)
        .is("deleted_at", null),
    );
    if (cons === null) return null;

    const sailingIds = unicos(cons.map((c) => str(c.sailing_id)));
    const sailings =
      sailingIds.length === 0
        ? []
        : await porTramos(sailingIds, (t) =>
            supabase.from("sailings").select("id, eta, carrier_id").in("id", t),
          );
    if (sailings === null) return null;
    const sailingPorId = new Map(sailings.map((s) => [String(s.id), s]));

    const carrierIds = unicos(sailings.map((s) => str(s.carrier_id)));
    const carriers =
      carrierIds.length === 0
        ? []
        : await porTramos(carrierIds, (t) =>
            supabase.from("carriers").select("id, name").in("id", t),
          );
    if (carriers === null) return null;
    const navieraPorId = new Map(carriers.map((c) => [String(c.id), str(c.name)]));

    const contenedores: ContenedorDeEmbarques[] = [];
    for (const c of cons) {
      const id = str(c.id);
      if (!id) continue;
      const sailing = str(c.sailing_id) ? sailingPorId.get(String(c.sailing_id)) : undefined;
      const carrierId = sailing ? str(sailing.carrier_id) : null;
      contenedores.push({
        id,
        ref: str(c.ref) ?? id,
        containerNo: str(c.container_no),
        numeroDtd: numeroDtdDeNotas(str(c.notes)),
        status: str(c.status) ?? "consolidando",
        naviera: carrierId ? navieraPorId.get(carrierId) ?? null : null,
        eta: sailing ? str(sailing.eta) : null,
        createdAt: str(c.created_at) ?? "",
      });
    }

    const vivos = new Set(contenedores.map((c) => c.id));
    const porEmbarque: Record<string, string> = {};
    const cajasPorEmbarque: Record<string, number> = {};
    for (const [sid, v] of vigente) {
      // Un contenedor eliminado no agrupa: su embarque va a «Sin contenedor».
      if (!vivos.has(v.cid)) continue;
      porEmbarque[sid] = v.cid;
      cajasPorEmbarque[sid] = v.cajas;
    }
    return { contenedores, porEmbarque, cajasPorEmbarque };
  } catch {
    return null;
  }
}

/**
 * SDD-0661 · Monto a cobrar por contenedor. Lee `invoices` con la sesión (RLS
 * por tenant): las facturas vivas no anuladas cuyo `shipment_id` es uno de los
 * embarques con contenedor.
 *
 * ⚠️ Quien llama decide el permiso ANTES (`moduleViewDenial(…, "invoices")`):
 * esta función consulta dinero. La página no la llama si la persona no ve
 * Facturación, así el dato ni se consulta ni viaja al navegador.
 */
export async function leerMontosDeContenedores(
  supabase: SupabaseClient,
  datos: ContenedoresDeEmbarques,
): Promise<MontosDeContenedores> {
  const ids = Object.keys(datos.porEmbarque);
  if (ids.length === 0) return { estado: "lista", porContenedor: {} };
  try {
    const filas = await porTramos(ids, (t) =>
      supabase
        .from("invoices")
        .select("shipment_id, currency, total_amount, status")
        .in("shipment_id", t)
        .is("deleted_at", null)
        .neq("status", "anulada"),
    );
    if (filas === null) return { estado: "no_disponible" };
    const facturas: FacturaDeEmbarque[] = filas.map((f) => ({
      shipment_id: str(f.shipment_id),
      currency: str(f.currency),
      total_amount: (f.total_amount as number | string | null) ?? null,
      status: str(f.status),
    }));
    return { estado: "lista", porContenedor: montosPorContenedor(facturas, datos.porEmbarque) };
  } catch {
    return { estado: "no_disponible" };
  }
}
