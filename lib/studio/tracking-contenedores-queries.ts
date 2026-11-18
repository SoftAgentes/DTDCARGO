/**
 * Lecturas del Tracking por contenedor (SDD-0659). Solo lee; RLS filtra por
 * tenant con el cliente de sesión.
 *
 * Qué contenedores entran a la pantalla:
 *  - los abiertos (consolidando, cerrado, zarpado);
 *  - los arribados con cambio reciente;
 *  - los que tienen adentro algún envío activo, estén como estén;
 *  - el que se pidió por URL, aunque ya esté entregado (se llega por el buscador).
 *
 * Los contenedores viejos ya entregados no se cargan: se acumulan con los años
 * y esta pantalla es la operación en curso.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import { listTrackingSnapshots } from "@/lib/studio/naviera-tracking/snapshot-queries";
import type { ContainerStatus } from "@/lib/studio/naviera/types";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";
import {
  DIAS_EN_DESTINO_SIN_ENLACE,
  patronIlike,
  type ContenedorCrudo,
  type EnvioDelItem,
  type ItemCrudo,
  type ItinerarioCrudo,
  type RastreoCrudo,
} from "./tracking-contenedores";

const CONTENEDOR_COLUMNS =
  "id, ref, booking_id, sailing_id, container_type, container_no, status, updated_at";
const ITEM_COLUMNS =
  "id, consolidation_id, shipment_id, client_markbox, client_name, cbm, weight_kg, pieces, created_at";
const ITINERARIO_COLUMNS = "id, vessel, pol, pod, etd, eta";
const ENVIO_COLUMNS = "id, code, status, destination";

const ESTADOS_ABIERTOS: readonly ContainerStatus[] = ["consolidando", "cerrado", "zarpado"];

/** Tope de filas por consulta del buscador. */
export const TOPE_DE_BUSQUEDA = 60;

type Fila = Record<string, unknown>;

export type ContenedorLeido = ContenedorCrudo & {
  sailing_id: string | null;
  booking_id: string | null;
};
export type ItemLeido = ItemCrudo & { consolidation_id: string };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const texto = (v: unknown) => (v == null ? null : String(v));

function aContenedor(r: Fila): ContenedorLeido {
  return {
    id: String(r.id),
    ref: texto(r.ref),
    sailing_id: texto(r.sailing_id),
    booking_id: texto(r.booking_id),
    container_type: texto(r.container_type),
    container_no: texto(r.container_no),
    status: (r.status as ContainerStatus) ?? "consolidando",
    updated_at: String(r.updated_at),
  };
}

function aItem(r: Fila): ItemLeido {
  return {
    id: String(r.id),
    consolidation_id: String(r.consolidation_id),
    shipment_id: texto(r.shipment_id),
    client_markbox: texto(r.client_markbox),
    client_name: texto(r.client_name),
    cbm: num(r.cbm),
    weight_kg: num(r.weight_kg),
    pieces: Math.round(num(r.pieces)),
  };
}

function unicos(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

async function leerContenedoresPorIds(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<ContenedorLeido[]> {
  if (ids.length === 0) return [];
  const { rows, complete } = await fetchAllByIds<Fila>(ids, (lote, d, h) =>
    supabase
      .from("consolidations")
      .select(CONTENEDOR_COLUMNS)
      .in("id", lote)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("Los contenedores superan el tope de lectura.");
  return rows.map(aContenedor);
}

/**
 * Contenedores de la pantalla (ver la cabecera del archivo). `idsDeEnviosActivos`
 * son los envíos en curso; `pedido` es el `?c=` de la URL.
 */
export async function leerContenedoresDeTracking(
  supabase: SupabaseClient,
  idsDeEnviosActivos: readonly string[],
  pedido: string | null,
  ahora: Date,
): Promise<{ contenedores: ContenedorLeido[]; items: ItemLeido[] }> {
  const corte = new Date(
    ahora.getTime() - DIAS_EN_DESTINO_SIN_ENLACE * 86_400_000,
  ).toISOString();

  // Las tres lecturas no dependen entre sí: van en paralelo.
  const [abiertos, arribados, enlaces] = await Promise.all([
    fetchAllPaged<Fila>((d, h) =>
      supabase
        .from("consolidations")
        .select(CONTENEDOR_COLUMNS)
        .in("status", [...ESTADOS_ABIERTOS])
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    fetchAllPaged<Fila>((d, h) =>
      supabase
        .from("consolidations")
        .select(CONTENEDOR_COLUMNS)
        .eq("status", "arribado")
        .gte("updated_at", corte)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    // Contenedores que llevan algún envío activo, aunque hayan arribado hace rato.
    fetchAllByIds<Fila>(idsDeEnviosActivos, (lote, d, h) =>
      supabase
        .from("consolidation_items")
        .select("id, consolidation_id, shipment_id")
        .in("shipment_id", lote)
        .order("id", { ascending: true })
        .range(d, h),
    ),
  ]);
  if (!abiertos.complete || !arribados.complete) {
    throw new Error("Los contenedores superan el tope de lectura.");
  }
  if (!enlaces.complete) {
    throw new Error("Los ítems de los contenedores superan el tope de lectura.");
  }

  const porId = new Map<string, ContenedorLeido>();
  for (const r of [...abiertos.rows, ...arribados.rows]) {
    const c = aContenedor(r);
    porId.set(c.id, c);
  }
  const faltan = unicos([
    ...enlaces.rows.map((r) => texto(r.consolidation_id)),
    pedido,
  ]).filter((id) => !porId.has(id));
  for (const c of await leerContenedoresPorIds(supabase, faltan)) porId.set(c.id, c);

  const contenedores = [...porId.values()];
  const items = await leerItemsDeContenedores(
    supabase,
    contenedores.map((c) => c.id),
  );
  return { contenedores, items };
}

export async function leerItemsDeContenedores(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<ItemLeido[]> {
  if (ids.length === 0) return [];
  const { rows, complete } = await fetchAllByIds<Fila>(ids, (lote, d, h) =>
    supabase
      .from("consolidation_items")
      .select(ITEM_COLUMNS)
      .in("consolidation_id", lote)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) {
    throw new Error("Los ítems de los contenedores superan el tope de lectura.");
  }
  return rows.map(aItem);
}

/** Itinerarios por id (buque, puertos, ETD y ETA). */
export async function leerItinerarios(
  supabase: SupabaseClient,
  ids: readonly (string | null)[],
): Promise<Map<string, ItinerarioCrudo>> {
  const mapa = new Map<string, ItinerarioCrudo>();
  const lista = unicos(ids);
  if (lista.length === 0) return mapa;
  const { rows, complete } = await fetchAllByIds<Fila>(lista, (lote, d, h) =>
    supabase
      .from("sailings")
      .select(ITINERARIO_COLUMNS)
      .in("id", lote)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("Los itinerarios superan el tope de lectura.");
  for (const r of rows) {
    mapa.set(String(r.id), {
      vessel: texto(r.vessel),
      pol: texto(r.pol),
      pod: texto(r.pod),
      etd: texto(r.etd),
      eta: texto(r.eta),
    });
  }
  return mapa;
}

/**
 * Último rastreo cacheado de cada contenedor (SDD-0101). Solo lee la caché: no
 * consulta a la naviera ni gasta cuota.
 */
export async function leerRastreos(
  supabase: SupabaseClient,
): Promise<Map<string, RastreoCrudo>> {
  const mapa = new Map<string, RastreoCrudo>();
  // Vienen del más reciente al más viejo: el primero de cada contenedor gana.
  for (const s of await listTrackingSnapshots(supabase)) {
    if (!s.consolidationId || mapa.has(s.consolidationId)) continue;
    if (s.fetchStatus !== "ok") continue;
    mapa.set(s.consolidationId, {
      vessel: s.vessel,
      podEta: s.podEta,
      lastLat: s.lastLat,
      lastLng: s.lastLng,
      fetchedAt: s.fetchedAt,
    });
  }
  return mapa;
}

/** Envíos por id, activos o no: para el estado de cada cliente del contenedor. */
export async function leerEnviosPorIds(
  supabase: SupabaseClient,
  ids: readonly (string | null)[],
): Promise<Map<string, EnvioDelItem>> {
  const mapa = new Map<string, EnvioDelItem>();
  const lista = unicos(ids);
  if (lista.length === 0) return mapa;
  const { rows, complete } = await fetchAllByIds<Fila>(lista, (lote, d, h) =>
    supabase
      .from("shipments")
      .select(ENVIO_COLUMNS)
      .in("id", lote)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) throw new Error("Los envíos superan el tope de lectura.");
  for (const r of rows) {
    mapa.set(String(r.id), {
      id: String(r.id),
      code: String(r.code),
      status: r.status as ShipmentStatus,
      destination: texto(r.destination),
    });
  }
  return mapa;
}

export type HallazgoDeBusqueda = {
  items: ItemLeido[];
  /** Todos los contenedores que hacen falta para pintar el resultado. */
  contenedores: ContenedorLeido[];
  /**
   * Los que coinciden por sí mismos (referencia, número o BL), con el BL que
   * coincidió cuando fue por BL. Los demás llegaron por un cliente.
   */
  directos: Map<string, { bl: string | null }>;
};

/**
 * Busca por Shipping Mark, por número o referencia de contenedor, por BL de la
 * reserva (`bookings.bl_number`) y, solo si
 * `porNombre`, por nombre del cliente. Con `porNombre` en false (equipo de
 * China, SDD-0531) la consulta por nombre NO se hace: no alcanza con ocultar el
 * resultado, porque acertar un nombre ya lo confirmaría.
 */
export async function buscarEnTracking(
  supabase: SupabaseClient,
  q: string,
  porNombre: boolean,
): Promise<HallazgoDeBusqueda> {
  const patron = patronIlike(q);

  const items = new Map<string, ItemLeido>();
  const columnas = porNombre ? ["client_markbox", "client_name"] : ["client_markbox"];
  for (const columna of columnas) {
    const { data, error } = await supabase
      .from("consolidation_items")
      .select(ITEM_COLUMNS)
      .ilike(columna, patron)
      .order("created_at", { ascending: false })
      .limit(TOPE_DE_BUSQUEDA);
    if (error) throw new Error(error.message);
    for (const r of (data as Fila[] | null) ?? []) {
      const it = aItem(r);
      items.set(it.id, it);
    }
  }

  const directos = new Map<string, ContenedorLeido>();
  for (const columna of ["ref", "container_no"]) {
    const { data, error } = await supabase
      .from("consolidations")
      .select(CONTENEDOR_COLUMNS)
      .ilike(columna, patron)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    for (const r of (data as Fila[] | null) ?? []) {
      const c = aContenedor(r);
      directos.set(c.id, c);
    }
  }

  // Por BL: la reserva guarda el BL y el contenedor apunta a su reserva.
  const coincidencias = new Map<string, { bl: string | null }>(
    [...directos.keys()].map((id) => [id, { bl: null }]),
  );
  const { data: reservas, error: errorDeReservas } = await supabase
    .from("bookings")
    .select("id, bl_number")
    .ilike("bl_number", patron)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (errorDeReservas) throw new Error(errorDeReservas.message);
  const blPorReserva = new Map(
    ((reservas as Fila[] | null) ?? []).map((r) => [String(r.id), texto(r.bl_number)]),
  );
  if (blPorReserva.size > 0) {
    const { data, error } = await supabase
      .from("consolidations")
      .select(CONTENEDOR_COLUMNS)
      .in("booking_id", [...blPorReserva.keys()])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(TOPE_DE_BUSQUEDA);
    if (error) throw new Error(error.message);
    for (const r of (data as Fila[] | null) ?? []) {
      const c = aContenedor(r);
      directos.set(c.id, c);
      coincidencias.set(c.id, { bl: blPorReserva.get(c.booking_id ?? "") ?? null });
    }
  }

  const faltan = unicos([...items.values()].map((i) => i.consolidation_id)).filter(
    (id) => !directos.has(id),
  );
  const deItems = await leerContenedoresPorIds(supabase, faltan);
  const visibles = new Set([...directos.keys(), ...deItems.map((c) => c.id)]);

  return {
    // Un ítem cuyo contenedor fue eliminado no se muestra: no hay a dónde ir.
    items: [...items.values()].filter((i) => visibles.has(i.consolidation_id)),
    contenedores: [...directos.values(), ...deItems],
    directos: coincidencias,
  };
}
