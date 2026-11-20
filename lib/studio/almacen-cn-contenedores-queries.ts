/**
 * Almacén China · lectura de «En camino» (SDD-0682 §2.2). Solo lee; RLS filtra
 * por tenant con el cliente de sesión.
 *
 * Reúne los contenedores que ya no están en la bodega (consolidando, cerrado,
 * zarpado) con sus ítems, su itinerario (ETA en `sailings.eta`, por
 * `sailing_id`) y el último rastreo cacheado, y los arma con la misma regla de
 * Tracking. Los nombres de cliente se descartan aquí: la vista de China no los
 * necesita y no deben viajar al navegador.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  leerItemsDeContenedores,
  leerItinerarios,
  leerRastreos,
} from "@/lib/studio/tracking-contenedores-queries";
import { armarContenedor, type ContenedorVista } from "@/lib/studio/tracking-contenedores";
import type { ContainerStatus } from "@/lib/studio/naviera/types";
import {
  enCaminoOrdenados,
  ESTADOS_EN_CAMINO,
  type ContenedorEnCamino,
} from "./almacen-cn-contenedores";

const COLUMNAS = "id, ref, sailing_id, container_type, container_no, status, updated_at";

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v == null ? null : String(v));

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
    updated_at: String(r.updated_at),
  }));

  const [items, itinerarios, rastreos] = await Promise.all([
    leerItemsDeContenedores(
      supabase,
      contenedores.map((c) => c.id),
    ),
    leerItinerarios(
      supabase,
      contenedores.map((c) => c.sailing_id),
    ),
    leerRastreos(supabase),
  ]);

  const itemsPorContenedor = new Map<string, typeof items>();
  for (const it of items) {
    const lista = itemsPorContenedor.get(it.consolidation_id) ?? [];
    lista.push(it);
    itemsPorContenedor.set(it.consolidation_id, lista);
  }

  const vistas = contenedores
    .map((c) =>
      armarContenedor(
        c,
        itemsPorContenedor.get(c.id) ?? [],
        new Map(),
        c.sailing_id ? (itinerarios.get(c.sailing_id) ?? null) : null,
        rastreos.get(c.id) ?? null,
        ahora,
      ),
    )
    .filter((v): v is ContenedorVista => v !== null);

  return enCaminoOrdenados(vistas);
}
