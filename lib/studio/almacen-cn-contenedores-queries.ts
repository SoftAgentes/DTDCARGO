/**
 * Almacén China · lectura de «En camino» (SDD-0682 §2.2). Solo lee; RLS filtra
 * por tenant con el cliente de sesión.
 *
 * Reúne los contenedores que ya zarparon (`ESTADOS_EN_CAMINO`) con:
 *  - sus ítems e itinerario (ETA en `sailings.eta`, por `sailing_id`) y el último
 *    rastreo cacheado, armados con la misma regla de Tracking;
 *  - el número DTD de `consolidations.notes` («contenedor DTD #64»);
 *  - la naviera (`sailings.carrier_id` → `carriers.name`);
 *  - las recepciones consolidadas que van en él: las `warehouse_receipts_cn` con
 *    `status = 'consolidado'` cuyo envío tiene a este contenedor como vigente
 *    (`leerContenedorVigentePorEnvio`). Un envío que se movió a otro contenedor no
 *    se lista aquí, así no sale dos veces.
 *
 * Los nombres de importador se descartan aquí: la vista de China no los usa y no
 * deben viajar al navegador. Solo el MARKBOX.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import {
  leerItemsDeContenedores,
  leerItinerarios,
  leerRastreos,
} from "@/lib/studio/tracking-contenedores-queries";
import { armarContenedor, type ContenedorVista } from "@/lib/studio/tracking-contenedores";
import { numeroDtdDeNotas } from "@/lib/studio/embarques-contenedores";
import type { ContainerStatus } from "@/lib/studio/naviera/types";
import {
  enCaminoOrdenados,
  ESTADOS_EN_CAMINO,
  lineaVigentePorEnvio,
  type ContenedorDeRecepcion,
  type ContenedorEnCamino,
  type ExtrasDelContenedor,
  type RecepcionEnCamino,
} from "./almacen-cn-contenedores";

const COLUMNAS = "id, ref, sailing_id, container_type, container_no, status, notes, updated_at";

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function unicos(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

/** Naviera por id de itinerario. */
async function leerNavieras(
  supabase: SupabaseClient,
  sailingIds: readonly string[],
): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();
  if (sailingIds.length === 0) return mapa;
  const sailings = await fetchAllByIds<Fila>(sailingIds, (lote, d, h) =>
    supabase.from("sailings").select("id, carrier_id").in("id", lote).order("id", { ascending: true }).range(d, h),
  );
  if (!sailings.complete) throw new Error("Los itinerarios superan el tope de lectura.");
  const carrierIds = unicos(sailings.rows.map((s) => texto(s.carrier_id)));
  const carriers =
    carrierIds.length === 0
      ? { rows: [] as Fila[], complete: true }
      : await fetchAllByIds<Fila>(carrierIds, (lote, d, h) =>
          supabase.from("carriers").select("id, name").in("id", lote).order("id", { ascending: true }).range(d, h),
        );
  if (!carriers.complete) throw new Error("Las navieras superan el tope de lectura.");
  const nombre = new Map(carriers.rows.map((c) => [String(c.id), texto(c.name)]));
  for (const s of sailings.rows) {
    const cid = texto(s.carrier_id);
    mapa.set(String(s.id), cid ? (nombre.get(cid) ?? null) : null);
  }
  return mapa;
}

/** El contenedor vigente de un envío, con lo necesario para decidir y nombrarlo. */
export type ContenedorVigente = ContenedorDeRecepcion & { id: string };

/**
 * Contenedor vigente de cada envío (SDD-0682): lee todas sus líneas de
 * `consolidation_items` y los contenedores vivos, y aplica `lineaVigentePorEnvio`
 * (la más reciente en un contenedor vivo). Un envío sin línea viva no aparece.
 * Lo usan «En almacén», su aviso y «En camino», así las tres cuentan igual.
 * Solo lee; RLS acota al tenant.
 */
export async function leerContenedorVigentePorEnvio(
  supabase: SupabaseClient,
  shipmentIds: readonly string[],
): Promise<Map<string, ContenedorVigente>> {
  const out = new Map<string, ContenedorVigente>();
  const ids = unicos(shipmentIds);
  if (ids.length === 0) return out;
  const lineas = await fetchAllByIds<Fila>(ids, (lote, d, h) =>
    supabase
      .from("consolidation_items")
      .select("id, shipment_id, consolidation_id, created_at")
      .in("shipment_id", lote)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!lineas.complete) throw new Error("Los ítems de los contenedores superan el tope de lectura.");
  const consIds = unicos(lineas.rows.map((l) => texto(l.consolidation_id)));
  const cons =
    consIds.length === 0
      ? { rows: [] as Fila[], complete: true }
      : await fetchAllByIds<Fila>(consIds, (lote, d, h) =>
          supabase
            .from("consolidations")
            .select("id, status, ref, notes")
            .in("id", lote)
            .is("deleted_at", null)
            .order("id", { ascending: true })
            .range(d, h),
        );
  if (!cons.complete) throw new Error("Los contenedores superan el tope de lectura.");
  const vivos = new Map<string, ContenedorVigente>(
    cons.rows.map((c) => [
      String(c.id),
      {
        id: String(c.id),
        status: String(c.status),
        numeroDtd: numeroDtdDeNotas(texto(c.notes)),
        ref: texto(c.ref),
      },
    ]),
  );
  const vigente = lineaVigentePorEnvio(
    lineas.rows
      .filter((l) => texto(l.shipment_id) && texto(l.consolidation_id))
      .map((l) => ({
        id: String(l.id ?? ""),
        shipmentId: String(l.shipment_id),
        consolidationId: String(l.consolidation_id),
        createdAt: String(l.created_at ?? ""),
      })),
    new Set(vivos.keys()),
  );
  for (const [sid, cid] of vigente) {
    const c = vivos.get(cid);
    if (c) out.set(sid, c);
  }
  return out;
}

/** Recepciones consolidadas por id de envío. */
async function leerRecepcionesPorEnvio(
  supabase: SupabaseClient,
  shipmentIds: readonly string[],
): Promise<Map<string, RecepcionEnCamino[]>> {
  const mapa = new Map<string, RecepcionEnCamino[]>();
  if (shipmentIds.length === 0) return mapa;
  const { rows, complete } = await fetchAllByIds<Fila>(shipmentIds, (lote, d, h) =>
    supabase
      .from("warehouse_receipts_cn")
      .select("id, receipt_code, client_markbox, boxes, total_cbm, shipment_id")
      .in("shipment_id", lote)
      .eq("status", "consolidado")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("Las recepciones superan el tope de lectura.");
  for (const r of rows) {
    const sid = texto(r.shipment_id);
    if (!sid) continue;
    const lista = mapa.get(sid) ?? [];
    lista.push({
      id: String(r.id),
      codigo: String(r.receipt_code ?? ""),
      markbox: texto(r.client_markbox),
      cajas: Math.round(num(r.boxes)),
      cbm: num(r.total_cbm),
    });
    mapa.set(sid, lista);
  }
  return mapa;
}

export async function leerContenedoresEnCamino(
  supabase: SupabaseClient,
  ahora: Date,
): Promise<ContenedorEnCamino[]> {
  const { rows, complete } = await fetchAllPaged<Fila>((d, h) =>
    supabase
      .from("consolidations")
      .select(COLUMNAS)
      .in("status", [...ESTADOS_EN_CAMINO])
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("Los contenedores superan el tope de lectura.");
  if (rows.length === 0) return [];

  const contenedores = rows.map((r) => ({
    id: String(r.id),
    ref: texto(r.ref),
    sailing_id: texto(r.sailing_id),
    container_type: texto(r.container_type),
    container_no: texto(r.container_no),
    status: (r.status as ContainerStatus) ?? "consolidando",
    notes: texto(r.notes),
    updated_at: String(r.updated_at),
  }));
  const sailingIds = unicos(contenedores.map((c) => c.sailing_id));

  const [items, itinerarios, rastreos, navieras] = await Promise.all([
    leerItemsDeContenedores(
      supabase,
      contenedores.map((c) => c.id),
    ),
    leerItinerarios(supabase, sailingIds),
    leerRastreos(supabase),
    leerNavieras(supabase, sailingIds),
  ]);
  const enviosDeLosItems = unicos(items.map((i) => i.shipment_id));
  const [recepcionesPorEnvio, vigentePorEnvio] = await Promise.all([
    leerRecepcionesPorEnvio(supabase, enviosDeLosItems),
    leerContenedorVigentePorEnvio(supabase, enviosDeLosItems),
  ]);

  const itemsPorContenedor = new Map<string, typeof items>();
  for (const it of items) {
    const lista = itemsPorContenedor.get(it.consolidation_id) ?? [];
    lista.push(it);
    itemsPorContenedor.set(it.consolidation_id, lista);
  }

  const extras = new Map<string, ExtrasDelContenedor>();
  const vistas: ContenedorVista[] = [];
  for (const c of contenedores) {
    const suyos = itemsPorContenedor.get(c.id) ?? [];
    const v = armarContenedor(
      c,
      suyos,
      new Map(),
      c.sailing_id ? (itinerarios.get(c.sailing_id) ?? null) : null,
      rastreos.get(c.id) ?? null,
      ahora,
    );
    if (!v) continue;
    vistas.push(v);
    // Solo los envíos cuyo contenedor vigente es este: uno que se movió a otro
    // contenedor conserva aquí su línea vieja, pero ya no va en él.
    const envios = unicos(suyos.map((i) => i.shipment_id)).filter(
      (sid) => vigentePorEnvio.get(sid)?.id === c.id,
    );
    extras.set(c.id, {
      numeroDtd: numeroDtdDeNotas(c.notes),
      naviera: c.sailing_id ? (navieras.get(c.sailing_id) ?? null) : null,
      recepciones: envios.flatMap((sid) => recepcionesPorEnvio.get(sid) ?? []),
    });
  }

  return enCaminoOrdenados(vistas, extras);
}
